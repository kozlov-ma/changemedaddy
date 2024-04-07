package fake

import (
	"changemedaddy/invest"
	"changemedaddy/market"
	"context"
	"math/rand"
)

type instrument struct {
	ticker              string
	ty                  invest.InstrumentType
	priceLow, priceHigh float64
}

type Market struct {
	instruments []instrument
}

func NewMarket() *Market {
	return &Market{
		instruments: []instrument{
			{
				ticker:    "YNDX",
				ty:        invest.TypeShares,
				priceLow:  3800,
				priceHigh: 4000,
			},
			{
				ticker:    "MAGN",
				ty:        invest.TypeShares,
				priceLow:  7800,
				priceHigh: 8200,
			},
		},
	}
}

func (m *Market) Price(ctx context.Context, instrument invest.InstrumentType, ticker string) (float64, error) {
	for _, i := range m.instruments {
		if i.ty == instrument && i.ticker == ticker {
			return i.priceLow + rand.Float64()*(i.priceHigh-i.priceLow), nil
		}
	}

	return 0, market.ErrInstrumentDoesNotExist
}
