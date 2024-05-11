package market

import (
	"changemedaddy/internal/domain/chart"
	"changemedaddy/internal/domain/instrument"
	"changemedaddy/internal/pkg/timeext"
	"context"
	"github.com/greatcloak/decimal"
	"math/rand"
	"strings"
	"time"
)

type fakeService struct {
}

func NewFakeService() *fakeService {
	return &fakeService{}
}

func (s *fakeService) Find(ctx context.Context, ticker string) (*instrument.Instrument, error) {
	ticker = strings.ToUpper(ticker)

	if ticker == "MGNT" {
		return &instrument.Instrument{
			Name:   "Магнит",
			Ticker: "MGNT",
		}, nil
	}

	if ticker == "SBER" {
		return &instrument.Instrument{
			Name:   "Сбер Банк",
			Ticker: "SBER",
		}, nil
	}

	return &instrument.Instrument{}, instrument.ErrNotFound
}

func (s *fakeService) Price(ctx context.Context, i *instrument.Instrument) (decimal.Decimal, error) {
	if i.Ticker == "MGNT" {
		return decimal.NewFromFloat(8240.1), nil
	}

	if i.Ticker == "SBER" {
		return decimal.NewFromFloat(309.2), nil
	}

	return decimal.Zero, instrument.ErrNotFound
}

func (s *fakeService) GetCandles(ctx context.Context, i *instrument.WithInterval) ([]chart.Candle, error) {
	if i.Instrument.Ticker == "MGNT" || i.Instrument.Ticker == "SBER" {
		endAt := timeext.Min(i.Deadline, time.Now())
		daysCount := endAt.Sub(i.OpenedAt).Hours() / 24

		var timeStep time.Duration
		var candlesCount int
		switch {
		case daysCount < 2:
			timeStep = 15 * time.Minute
			candlesCount = int(daysCount * float64(24*60) / 15)
		case daysCount < 15:
			timeStep = time.Hour
			candlesCount = int(daysCount * float64(24))
		default:
			timeStep = 24 * time.Hour
			candlesCount = int(daysCount)
		}

		candles := make([]chart.Candle, 0)

		prevClose := 1000
		var candlesBeforeOpened time.Duration = 15
		candlesCount += int(candlesBeforeOpened)
		curDate := i.OpenedAt.Add(-candlesBeforeOpened * timeStep)

		for i := 0; i < candlesCount; i++ {
			opn := prevClose
			cls := opn + rand.Intn(20) - 10
			high := max(opn, cls) + rand.Intn(11)
			low := min(opn, cls) - rand.Intn(11)

			candles = append(candles, chart.Candle{
				Time:  curDate.Unix(),
				Open:  float64(opn),
				High:  float64(high),
				Low:   float64(low),
				Close: float64(cls),
			})

			curDate = curDate.Add(timeStep)
			prevClose = cls
		}

		return candles, nil
	}

	return nil, instrument.ErrNotFound
}
