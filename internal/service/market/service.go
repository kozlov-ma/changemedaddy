package market

import (
	"changemedaddy/internal/domain/instrument"
	"context"

	"github.com/greatcloak/decimal"
)

type fakeService struct {
}

func NewFakeService() *fakeService {
	return &fakeService{}
}

func (s *fakeService) Instrument(ctx context.Context, ticker string) (*instrument.Instrument, error) {
	if ticker == "MGNT" {
		return &instrument.Instrument{
			Name:   "Магнит",
			Ticker: "MGNT",
		}, nil
	}

	return &instrument.Instrument{}, instrument.ErrNotFound
}

func (s *fakeService) Price(ctx context.Context, i *instrument.Instrument) (decimal.Decimal, error) {
	if i.Ticker == "MGNT" {
		return decimal.NewFromFloat(100), nil
	}

	return decimal.Zero, instrument.ErrNotFound
}