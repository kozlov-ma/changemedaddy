package market

import (
	"changemedaddy/internal/domain/chart"
	"changemedaddy/internal/domain/instrument"
	"context"
	"fmt"
	"github.com/greatcloak/decimal"
	"math/rand"
	"strings"
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
		candlesCount := int(i.CurTime.Sub(i.OpenedAt).Hours() / 24)
		candles := make([]chart.Candle, 0)

		prevClose := 1000
		curDate := i.OpenedAt

		for i := 0; i < candlesCount; i++ {
			opn := prevClose
			cls := opn + rand.Intn(20) - 10
			high := max(opn, cls) + rand.Intn(11)
			low := min(opn, cls) - rand.Intn(11)

			curDate = curDate.AddDate(0, 0, 1)
			year, month, day := curDate.Date()
			candles = append(candles, chart.Candle{
				Time:  fmt.Sprintf("%d-%02d-%02d", year, int(month), day),
				Open:  opn,
				High:  high,
				Low:   low,
				Close: cls,
			})

			prevClose = cls
		}

		return candles, nil
	}

	return nil, instrument.ErrNotFound
}
