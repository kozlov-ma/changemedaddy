package instrument

import (
	"context"
	"fmt"
	"time"

	"github.com/greatcloak/decimal"
)

type Instrument struct {
	Name   string
	Ticker string
	Uid    string
}

type WithPrice struct {
	*Instrument
	Price decimal.Decimal
}

type WithInterval struct {
	*Instrument
	OpenedAt time.Time
	Deadline time.Time
}

type priceProvider interface {
	Price(ctx context.Context, i *Instrument) (decimal.Decimal, error)
}

func (i *Instrument) WithPrice(ctx context.Context, pp priceProvider) (WithPrice, error) {
	price, err := pp.Price(ctx, i)
	if err != nil {
		return WithPrice{}, fmt.Errorf("couldn't get instrument price: %w", err)
	}

	return WithPrice{
		Instrument: i,
		Price:      price,
	}, nil
}

func (i *Instrument) WithInterval(ctx context.Context, openedAt time.Time, deadline time.Time) (WithInterval, error) {
	if openedAt.After(deadline) {
		return WithInterval{}, fmt.Errorf("openedAt %s > deadline %s", openedAt, deadline)
	}
	if openedAt.After(time.Now()) {
		return WithInterval{}, fmt.Errorf("openedAt %s > now %s", openedAt, time.Now())
	}
	return WithInterval{
		Instrument: i,
		OpenedAt:   openedAt,
		Deadline:   deadline,
	}, nil
}
