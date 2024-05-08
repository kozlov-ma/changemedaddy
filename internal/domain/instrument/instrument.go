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
}

type WithPrice struct {
	*Instrument
	Price decimal.Decimal
}

type WithInterval struct {
	*Instrument
	OpenedAt time.Time
	CurTime  time.Time
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

func (i *Instrument) WithInterval(ctx context.Context, openedAt time.Time, curTime time.Time) (WithInterval, error) {
	if openedAt.After(curTime) {
		return WithInterval{}, fmt.Errorf("openedAt %s > curTime %s", openedAt, curTime)
	}
	if curTime.After(time.Now()) {
		return WithInterval{}, fmt.Errorf("curTime %s > now %s", openedAt, time.Now())
	}
	return WithInterval{
		Instrument: i,
		OpenedAt:   openedAt,
		CurTime:    curTime,
	}, nil
}
