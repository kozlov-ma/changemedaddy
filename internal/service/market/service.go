package market

import (
	"changemedaddy/internal/domain/instrument"
	"context"

	"github.com/shopspring/decimal"
)

type fakeService struct {
}

func NewFakeService() *fakeService {
	return &fakeService{}
}

func (s *fakeService) Instrument(ctx context.Context, ticker string) (instrument.Instrument, error) {
	if ticker == "MGNT" {
		return instrument.Instrument{
			Name:   "Magnet",
			Ticker: "MGNT",
		}, nil
	}

	return instrument.Instrument{}, ErrInstrumentNotFound
}

func (s *fakeService) Price(ctx context.Context, i *instrument.Instrument) (decimal.Decimal, error) {
	if i.Ticker == "MGNT" {
		return decimal.NewFromFloat(100), nil
	}

	return decimal.Zero, ErrInstrumentNotFound
}
