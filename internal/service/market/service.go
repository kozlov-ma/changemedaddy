package market

import (
	"changemedaddy/internal/domain/chart"
	"changemedaddy/internal/domain/instrument"
	"changemedaddy/internal/pkg/collection"
	"changemedaddy/internal/pkg/timeext"
	"context"
	"fmt"
	"github.com/greatcloak/decimal"
	pb "github.com/russianinvestments/invest-api-go-sdk/proto"
	"log/slog"
	"strings"
	"time"

	"go.uber.org/zap"
	"go.uber.org/zap/zapcore"

	"github.com/russianinvestments/invest-api-go-sdk/investgo"
)

var (
	allowedClassCodes = collection.NewSet(
		"TQBR", "TQBS",
		"TQDE", "TQIF", "TQLI",
		"TQLV", "TQNE", "TQNL",
		"TQPI", "TQTF",
	)

	MarkerIntervalToDuration = map[int]time.Duration{
		1:  1 * time.Minute,
		10: 2 * 60 * time.Minute,
		6:  2 * time.Minute,
		7:  3 * time.Minute,
		11: 4 * 60 * time.Minute,
		4:  60 * time.Minute,
		2:  5 * time.Minute,
		8:  10 * time.Minute,
		3:  15 * time.Minute,
		9:  30 * time.Minute,
		5:  24 * 60 * time.Minute,
		13: 4 * 7 * 24 * 60 * time.Minute,
		0:  7 * 24 * 60 * time.Minute,
		12: 7 * 24 * 60 * time.Minute,
	}
)

type service struct {
	logger             *slog.Logger
	client             *investgo.Client
	instrumentsService *investgo.InstrumentsServiceClient
	marketDataService  *investgo.MarketDataServiceClient
}

func NewService(log *slog.Logger) *service {
	config, err := investgo.LoadConfig("internal/service/market/config.yaml")
	if err != nil {
		log.Error("config loading error", "error", err.Error())
	}

	// сдк использует для внутреннего логирования investgo.Logger
	// для примера передадим uber.zap
	zapConfig := zap.NewDevelopmentConfig()
	zapConfig.EncoderConfig.EncodeTime = zapcore.TimeEncoderOfLayout(time.DateTime)
	zapConfig.EncoderConfig.TimeKey = "time"
	l, err := zapConfig.Build()
	logger := l.Sugar()
	if err != nil {
		log.Error("logger creating error", "error", err)
	}
	// создаем клиента для investAPI, он позволяет создавать нужные сервисы и уже
	// через них вызывать нужные методы
	client, err := investgo.NewClient(context.Background(), config, logger)
	if err != nil {
		log.Error("client creating error ", "error", err.Error())
	}

	// создаем клиента для сервиса инструментов
	instrumentsService := client.NewInstrumentsServiceClient()
	// создаем клиента для сервиса маркетдаты
	marketDataService := client.NewMarketDataServiceClient()
	return &service{
		logger:             log,
		client:             client,
		instrumentsService: instrumentsService,
		marketDataService:  marketDataService,
	}
}

func (s *service) Find(ctx context.Context, ticker string) (*instrument.Instrument, error) {
	ticker = strings.ToUpper(ticker)

	instrResp, err := s.instrumentsService.FindInstrument(ticker)
	if err != nil {
		return &instrument.Instrument{}, instrument.ErrNotFound
	}

	ins := instrResp.GetInstruments()
	found := false
	for _, in := range ins {
		if found == true {
			break
		}
		if in.Ticker == ticker && allowedClassCodes.Contains(in.GetClassCode()) {
			found = true
			return &instrument.Instrument{
				Name:   in.GetName(),
				Ticker: in.GetTicker(),
				Uid:    in.GetUid(),
			}, nil
		}
	}

	return &instrument.Instrument{
		Name:   ins[0].GetName(),
		Ticker: ins[0].GetTicker(),
		Uid:    ins[0].GetUid(),
	}, nil
}

func (s *service) Price(ctx context.Context, i *instrument.Instrument) (decimal.Decimal, error) {
	instruments := []string{i.Uid}

	lastPriceResp, err := s.marketDataService.GetLastPrices(instruments)
	if err != nil {
		return decimal.Zero, fmt.Errorf("fail to get price %w", err)
	}
	lp := lastPriceResp.GetLastPrices()
	res := lp[0].GetPrice().ToFloat()
	return decimal.NewFromFloat(res), nil
}

func (s *service) GetCandles(ctx context.Context, i *instrument.WithInterval) ([]chart.Candle, error) {
	from := i.OpenedAt.Local().Add(-120 * MarkerIntervalToDuration[i.MarketInterval])
	to := timeext.Min(i.Deadline.Local(), time.Now().Local())

	req := &investgo.GetHistoricCandlesRequest{
		Instrument: i.Uid,
		Interval:   pb.CandleInterval(i.MarketInterval),
		From:       from,
		To:         to,
		File:       false,
		FileName:   "",
		Source:     pb.GetCandlesRequest_CANDLE_SOURCE_UNSPECIFIED,
	}
	candles, err := s.marketDataService.GetHistoricCandles(req)
	if err != nil {
		s.logger.Debug("пизда рулям", "req", req)
		return []chart.Candle{}, fmt.Errorf("fail to get candles %w", err)
	}

	chartCandles := make([]chart.Candle, 0)
	for _, candle := range candles {
		chartCandles = append(chartCandles, chart.Candle{
			Time:  candle.Time.AsTime().Unix(),
			Open:  candle.Open.ToFloat(),
			High:  candle.High.ToFloat(),
			Low:   candle.Low.ToFloat(),
			Close: candle.Close.ToFloat(),
		})
	}

	return chartCandles, nil
}

func (s *service) Shutdown(ctx context.Context) error {
	s.logger.Info("closing client connection")
	if err := s.client.Stop(); err != nil {
		return fmt.Errorf("client shutdown error %w", err)
	}

	return nil
}
