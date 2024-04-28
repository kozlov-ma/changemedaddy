package market

import (
	"changemedaddy/internal/domain/instrument"
	"context"
	"strings"

	"github.com/greatcloak/decimal"
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
