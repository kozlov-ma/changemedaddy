package market

import (
	"changemedaddy/internal/domain/chart"
	"changemedaddy/internal/domain/instrument"
	"changemedaddy/internal/pkg/timeext"
	"context"
	"github.com/greatcloak/decimal"
	pb "github.com/russianinvestments/invest-api-go-sdk/proto"
	"log"
	"strings"
	"time"

	"go.uber.org/zap"
	"go.uber.org/zap/zapcore"

	"github.com/russianinvestments/invest-api-go-sdk/investgo"
)

type service struct {
	logger             *zap.SugaredLogger
	client             *investgo.Client
	instrumentsService *investgo.InstrumentsServiceClient
	marketDataService  *investgo.MarketDataServiceClient
}

func NewService(ctx context.Context) *service {
	config, err := investgo.LoadConfig("internal/service/market/config.yaml")
	if err != nil {
		log.Fatalf("config loading error %v", err.Error())
	}

	// сдк использует для внутреннего логирования investgo.Logger
	// для примера передадим uber.zap
	zapConfig := zap.NewDevelopmentConfig()
	zapConfig.EncoderConfig.EncodeTime = zapcore.TimeEncoderOfLayout(time.DateTime)
	zapConfig.EncoderConfig.TimeKey = "time"
	l, err := zapConfig.Build()
	logger := l.Sugar()
	if err != nil {
		log.Fatalf("logger creating error %v", err)
	}
	// создаем клиента для investAPI, он позволяет создавать нужные сервисы и уже
	// через них вызывать нужные методы
	client, err := investgo.NewClient(ctx, config, logger)
	if err != nil {
		logger.Fatalf("client creating error %v", err.Error())
	}

	// создаем клиента для сервиса инструментов
	instrumentsService := client.NewInstrumentsServiceClient()
	// создаем клиента для сервиса маркетдаты
	marketDataService := client.NewMarketDataServiceClient()
	return &service{
		logger:             logger,
		client:             client,
		instrumentsService: instrumentsService,
		marketDataService:  marketDataService,
	}
}

func (s *service) Find(ctx context.Context, ticker string) (*instrument.Instrument, error) {
	ticker = strings.ToUpper(ticker)

	instrResp, err := s.instrumentsService.FindInstrument(ticker)
	if err != nil {
		s.logger.Errorf(err.Error())
		return &instrument.Instrument{}, instrument.ErrNotFound
	}

	ins := instrResp.GetInstruments()
	found := false
	for _, in := range ins {
		if found == true {
			break
		}
		if in.Ticker == ticker {
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
		s.logger.Error(err.Error())
		return decimal.Zero, instrument.ErrNotFound
	}
	lp := lastPriceResp.GetLastPrices()
	res := lp[0].GetPrice().ToFloat()
	s.logger.Debugf("last price number %v = %v\n", i.Ticker, res)
	return decimal.NewFromFloat(res), nil
}

func (s *service) GetCandles(ctx context.Context, i *instrument.WithInterval) ([]chart.Candle, error) {
	to := timeext.Min(i.Deadline, time.Now())
	candles, err := s.marketDataService.GetHistoricCandles(&investgo.GetHistoricCandlesRequest{
		Instrument: i.Uid,
		Interval:   pb.CandleInterval_CANDLE_INTERVAL_1_MIN,
		From:       i.OpenedAt,
		To:         to,
		File:       false,
		FileName:   "",
		Source:     pb.GetCandlesRequest_CANDLE_SOURCE_UNSPECIFIED,
	})
	if err != nil {
		s.logger.Errorf(err.Error())
		return []chart.Candle{}, err
	}

	chartCandles := make([]chart.Candle, 0)
	for _, candle := range candles {
		chartCandles = append(chartCandles, chart.Candle{
			Time:  int(candle.Time.AsTime().Unix()),
			Open:  int(candle.Open.Units),
			High:  int(candle.High.Units),
			Low:   int(candle.Low.Units),
			Close: int(candle.Close.Units),
		})
	}

	return chartCandles, nil
}

func (s *service) Shutdown(ctx context.Context) error {
	if err := s.logger.Sync(); err != nil {
		log.Printf(err.Error())
		return err
	}

	s.logger.Infof("closing client connection")
	if err := s.client.Stop(); err != nil {
		s.logger.Errorf("client shutdown error %v", err.Error())
		return err
	}

	return nil
}
