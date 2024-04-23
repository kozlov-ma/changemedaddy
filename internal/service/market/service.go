package market

import (
	"changemedaddy/internal/model"
	"context"

	"github.com/shopspring/decimal"
)

type fakeService struct {
}

func NewFakeService() *fakeService {
	return &fakeService{}
}

func (s *fakeService) Instrument(ctx context.Context, ticker string) (*model.Instrument, error) {
	if ticker == "MGNT" {
		return &model.Instrument{
			Name:     "Magnet",
			Ticker:   "MGNT",
			CurPrice: decimal.NewFromInt(8241),
		}, nil
	}

	return nil, nil
}
