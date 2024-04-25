package instrument

import (
	"changemedaddy/internal/pkg/assert"
	"context"

	"github.com/greatcloak/decimal"
)

type Instrument struct {
	Name   string
	Ticker string
}

type marketProvider interface {
	Price(ctx context.Context, i *Instrument) (decimal.Decimal, error)
}

func (i *Instrument) Price(ctx context.Context, mp marketProvider) (decimal.Decimal, error) {
	assert.That(i != nil, "trusted data; instrument is nil")
	return mp.Price(ctx, i)
}
