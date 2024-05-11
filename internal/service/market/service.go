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
	to := timeext.Min(i.Deadline, time.Now())
	candles, err := s.marketDataService.GetHistoricCandles(&investgo.GetHistoricCandlesRequest{
		Instrument: i.Uid,
		Interval:   pb.CandleInterval_CANDLE_INTERVAL_HOUR,
		From:       time.Now().Add(-48 * time.Hour),
		To:         to,
		File:       false,
		FileName:   "",
		Source:     pb.GetCandlesRequest_CANDLE_SOURCE_UNSPECIFIED,
	})
	if err != nil {
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
