package position

import (
	"changemedaddy/internal/domain/instrument"
	"changemedaddy/internal/pkg/assert"
	"context"
	"errors"
	"fmt"
	"math/rand/v2"
	"time"

	"github.com/greatcloak/decimal"
)

type (
	Type string

	Status string

	Position struct {
		ID int `bson:"id"`

		Instrument *instrument.Instrument `bson:"instrument"`

		Type   Type   `bson:"type"`
		Status Status `bson:"status"`

		OpenPrice   decimal.Decimal `bson:"open_price"`
		TargetPrice decimal.Decimal `bson:"target_price"`
		ClosedPrice decimal.Decimal `bson:"closed_price"`

		Deadline time.Time `bson:"deadline"`
		OpenDate time.Time `bson:"open_date"`
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

type CreationOptions struct {
	Ticker      string `form:"ticker"`
	Type        Type   `form:"type"`
	TargetPrice string `form:"target_price"`
	Deadline    string `form:"deadline"`
}

func New(ctx context.Context, mp marketProvider, ps positionSaver, opt CreationOptions) (*Position, error) {
	var parseError error

	i, err := mp.Find(ctx, opt.Ticker)
	if errors.Is(instrument.ErrNotFound, err) {
		parseError = errors.Join(parseError, err, ErrTicker)
	} else if err != nil {
		return nil, fmt.Errorf("couldn't get instrument: %w", err)
	}

	if opt.Type != Long && opt.Type != Short {
		parseError = errors.Join(parseError, ErrParseType)
	}

	tp, err := decimal.NewFromString(opt.TargetPrice)
	if err != nil || tp.LessThan(decimal.Zero) {
		parseError = errors.Join(parseError, err, ErrTargetPrice)
	}

	deadline, err := time.ParseInLocation("2.01.2006", opt.Deadline, time.Local)
	if err != nil {
		parseError = errors.Join(parseError, err, ErrParseDeadline)
	} else if deadline.Before(time.Now()) {
		parseError = errors.Join(parseError, ErrParseDeadline)
	}

	wp, err := i.WithPrice(ctx, mp)
	if err != nil {
		return nil, fmt.Errorf("couldn't get instrument (%q) price: %w", i.Ticker, err)
	}

	if opt.Type == Long && tp.LessThan(wp.Price) {
		parseError = errors.Join(ErrTargetPrice)
	} else if opt.Type == Short && wp.Price.LessThan(tp) {
		parseError = errors.Join(ErrTargetPrice)
	}

	if parseError != nil {
		return nil, parseError
	}

	pos := &Position{
		ID:          rand.Int(),
		Instrument:  i,
		Type:        opt.Type,
		Status:      Active,
		OpenPrice:   wp.Price,
		TargetPrice: tp,
		Deadline:    deadline,
		OpenDate:    time.Now(),
	}

	err = ps.Save(ctx, pos)
	if err != nil {
		return nil, fmt.Errorf("couldn't save position: %w", err)
	}

	return pos, nil
}

type WithProfit struct {
	*Position
	Instrument *instrument.WithPrice
	ProfitP    decimal.Decimal
}

func (p *Position) WithProfit(ctx context.Context, pp priceProvider) (WithProfit, error) {
	wp, err := p.Instrument.WithPrice(ctx, pp)
	if err != nil {
		return WithProfit{}, fmt.Errorf("couldn't get instrument quote: %w", err)
	}

	var (
		mul     decimal.Decimal
		profitP decimal.Decimal
	)
	if p.Type == Long {
		mul = one
	} else if p.Type == Short {
		mul = negOne
	} else {
		panic(fmt.Sprintf("unknown position type %q in trusted data", p.Type))
	}

	if p.Status == Closed {
		profitP = p.ClosedPrice.Sub(p.OpenPrice).Mul(mul).Div(p.OpenPrice).Mul(decimal.NewFromInt(100))
	} else {
		profitP = wp.Price.Sub(p.OpenPrice).Mul(mul).Div(p.OpenPrice).Mul(decimal.NewFromInt(100))
	}

	return WithProfit{
		Position:   p,
		Instrument: &wp,
		ProfitP:    profitP,
	}, nil
}

var (
	one    = decimal.NewFromInt(1)
	negOne = decimal.NewFromInt(-1)
)

type positionSaver interface {
	Save(ctx context.Context, p *Position) error
}

type positionUpdater interface {
	Update(ctx context.Context, p *Position) error
}

func (wp WithProfit) Close(ctx context.Context, pu positionUpdater) error {
	if wp.Status == Closed {
		return ErrClosedPositionModified
	}

	oldd := wp.Position.Deadline

	wp.Status = Closed
	wp.ClosedPrice = wp.Instrument.Price
	wp.Deadline = time.Now()

	err := pu.Update(ctx, wp.Position)
	if err == nil {
		return nil
	}

	wp.Deadline = oldd
	wp.Status = Active
	return fmt.Errorf("couldn't save position: %w", err)
}

func (p *Position) ChangeDeadline(ctx context.Context, pu positionUpdater, newDeadline time.Time) error {
	if p.Status == Closed {
		return ErrClosedPositionModified
	}

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
	if p.Status == Closed {
		return ErrClosedPositionModified
	}

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

type ChangeOptions struct {
	TargetPrice string `form:"target_price"`
	Deadline    string `form:"deadline"`
	Close       string `form:"close"`
}

func (wp *WithProfit) ApplyChange(ctx context.Context, opt ChangeOptions, pu positionUpdater) error {
	var parseError error

	if opt.TargetPrice != "" {
		tp, err := decimal.NewFromString(opt.TargetPrice)
		if err != nil || tp.LessThan(decimal.Zero) {
			parseError = errors.Join(parseError, err, ErrTargetPrice)
		} else {
			if wp.Type == Long && tp.LessThan(wp.Instrument.Price) {
				parseError = errors.Join(ErrTargetPrice)
			} else if wp.Type == Short && wp.Instrument.Price.LessThan(tp) {
				parseError = errors.Join(ErrTargetPrice)
			} else {
				if err := wp.ChangeTargetPrice(ctx, pu, tp); err != nil {
					return fmt.Errorf("couldn't change target price: %w", err)
				}
			}
		}
	}

	if opt.Deadline != "" {
		deadline, err := time.ParseInLocation("2.01.2006", opt.Deadline, time.Local)
		if err != nil {
			parseError = errors.Join(parseError, err, ErrParseDeadline)
		} else if deadline.Before(time.Now()) {
			parseError = errors.Join(parseError, ErrParseDeadline)
		} else {
			if err := wp.ChangeDeadline(ctx, pu, deadline); err != nil {
				return fmt.Errorf("couldn't change deadline: %w", err)
			}
		}
	}

	if parseError != nil {
		return parseError
	}

	if opt.Close == "true" {
		if err := wp.Close(ctx, pu); err != nil {
			return fmt.Errorf("couldn't close position: %w", err)
		}
	}

	return parseError
}
