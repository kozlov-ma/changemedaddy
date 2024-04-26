package position

import (
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
		ID int
		// Author      *analyst.Analyst
		Instrument  *instrument.Instrument
		Type        Type
		Status      Status
		OpenPrice   decimal.Decimal
		TargetPrice decimal.Decimal
		ClosedPrice decimal.Decimal
		Deadline    time.Time
		OpenDate    time.Time
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

type instrumentProvider interface {
	Find(ctx context.Context, ticker string) (*instrument.Instrument, error)
}

type marketProvider interface {
	priceProvider
	instrumentProvider
}

type PositionOptions struct {
	Ticker      string          `json:"ticker"`
	Type        Type            `json:"type"`
	TargetPrice decimal.Decimal `json:"target_price"`
	Deadline    time.Time       `json:"deadline"`
}

func NewPosition(ctx context.Context, mp marketProvider, ps positionSaver, opt PositionOptions) (*Position, error) {
	i, err := mp.Find(ctx, opt.Ticker)
	if err != nil {
		return nil, fmt.Errorf("couldn't get instrument: %w", err)
	}

	price, err := i.Price(ctx, mp)
	if err != nil {
		return nil, fmt.Errorf("couldn't get instrument (%q) price: %w", i.Ticker, err)
	}

	pos := &Position{
		Instrument:  i,
		Type:        opt.Type,
		Status:      Active,
		OpenPrice:   price,
		TargetPrice: opt.TargetPrice,
		Deadline:    opt.Deadline,
		OpenDate:    time.Now(),
	}

	err = ps.Save(ctx, pos)
	if err != nil {
		return nil, fmt.Errorf("couldn't save position: %w", err)
	}

	return pos, nil
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

func (q Quoted) Profit(ctx context.Context) decimal.Decimal {
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

func (q Quoted) Close(ctx context.Context, pu positionUpdater) error {
	q.Status = Closed
	q.ClosedPrice = q.Instrument.Price

	err := pu.Update(ctx, q.Position)
	if err == nil { // TODO test this
		return nil
	}

	q.Status = Active
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
