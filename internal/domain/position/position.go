package position

import (
	"changemedaddy/internal/domain/analyst"
	"changemedaddy/internal/domain/instrument"
	"changemedaddy/internal/pkg/assert"
	"context"
	"fmt"
	"time"

	"github.com/greatcloak/decimal"
)

type (
	Type string

	Status string

	Position struct {
		ID          int                    `bson:"_id"`
		Autor       *analyst.Analyst       `bson:"analyst"`
		Instrument  *instrument.Instrument `bson:"instrument"`
		Type        Type                   `bson:"type"`
		Status      Status                 `bson:"status"`
		OpenPrice   decimal.Decimal        `bson:"open_price"`
		TargetPrice decimal.Decimal        `bson:"target_price"`
		ClosedPrice decimal.Decimal        `bson:"closed_price"`
		Deadline    time.Time              `bson:"deadline"`
		OpenDate    time.Time              `bson:"open_date"`
	}
)

const (
	Long  Type = "long"
	Short Type = "short"
)

const (
	Active Status = "active"
	Closed Status = "closed"
)

type priceProvider interface {
	Price(ctx context.Context, i *instrument.Instrument) (decimal.Decimal, error)
}

type Quoted struct {
	*Position
	Instrument *instrument.Quoted
}

func (p *Position) Quote(ctx context.Context, pp priceProvider) (Quoted, error) {
	q, err := p.Instrument.Quote(ctx, pp)
	if err != nil {
		return Quoted{}, fmt.Errorf("couldn't get instrument quote: %w", err)
	}

	return Quoted{
		Position:   p,
		Instrument: &q,
	}, nil
}

var (
	one    = decimal.NewFromInt(1)
	negOne = decimal.NewFromInt(-1)
)

func (q *Quoted) Profit(ctx context.Context) decimal.Decimal {
	var mul decimal.Decimal
	if q.Type == Long {
		mul = one
	} else if q.Type == Short {
		mul = negOne
	} else {
		panic(fmt.Sprintf("unknown position type %q in trusted data", q.Type))
	}

	if q.Status == Closed {
		return q.ClosedPrice.Sub(q.OpenPrice).Mul(mul)
	}

	return q.Instrument.Price.Sub(q.OpenPrice).Mul(mul)
}

type positionSaver interface {
	Save(ctx context.Context, p *Position) error
}

func (p *Position) Save(ctx context.Context, to positionSaver) error {
	return to.Save(ctx, p)
}

type positionUpdater interface {
	Update(ctx context.Context, p *Position) error
}

func (p *Position) Close(ctx context.Context, atPrice decimal.Decimal, pu positionUpdater) error {
	assert.That(atPrice.GreaterThan(decimal.Zero), "non-positive price in trusted data")

	p.Status = Closed
	p.ClosedPrice = atPrice

	err := pu.Update(ctx, p)
	if err == nil {
		return nil
	}

	p.Status = Active
	return fmt.Errorf("couldn't save position: %w", err)
}

func (p *Position) ChangeDeadline(ctx context.Context, pu positionUpdater, newDeadline time.Time) error {
	old := p.Deadline
	p.Deadline = newDeadline

	err := pu.Update(ctx, p)
	if err == nil {
		return nil
	}

	p.Deadline = old
	return fmt.Errorf("couldn't save position: %w", err)
}

func (p *Position) ChangeTargetPrice(ctx context.Context, pu positionUpdater, newTargetPrice decimal.Decimal) error {
	assert.That(newTargetPrice.GreaterThan(decimal.Zero), "non-positive target price in trusted data")

	old := p.TargetPrice
	p.TargetPrice = newTargetPrice

	err := pu.Update(ctx, p)
	if err == nil {
		return nil
	}

	p.TargetPrice = old
	return fmt.Errorf("couldn't save position: %w", err)
}
