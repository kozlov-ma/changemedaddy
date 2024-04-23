package position

import (
	"changemedaddy/internal/domain"
	"changemedaddy/internal/domain/instrument"
	"context"

	"github.com/shopspring/decimal"
)

type (
	Type string

	Status string

	Position struct {
		ID          int                   `bson:"_id"`
		Instrument  instrument.Instrument `bson:"instrument"`
		Type        Type                  `bson:"type"`
		Status      Status                `bson:"status"`
		StartPrice  decimal.Decimal       `bson:"start_price"`
		TargetPrice decimal.Decimal       `bson:"target_price"`
		IdeaPart    decimal.Decimal       `bson:"idea_part"`
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

type marketProvider interface {
	Price(ctx context.Context, i *instrument.Instrument) (decimal.Decimal, error)
}

func (p *Position) ProfitP(ctx context.Context, mp marketProvider) (decimal.Decimal, error) {
	if p == nil {
		return decimal.Zero, nil
	}
	if p.Status == Closed {
		return decimal.Zero, domain.ErrClosedPositionModified
	}

	curPrice, err := p.Instrument.Price(ctx, mp)
	if err != nil {
		return decimal.Zero, err
	}

	if p.Type == Long {
		return curPrice.Sub(p.StartPrice).Div(p.StartPrice).Mul(decimal.NewFromInt(100)), nil
	}
	return p.StartPrice.Sub(curPrice).Div(p.StartPrice).Mul(decimal.NewFromInt(100)), nil
}
