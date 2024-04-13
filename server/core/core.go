package core

import (
	"context"

	"github.com/go-playground/validator/v10"

	"changemedaddy/internal/pkg/invest"
)

var (
	Validate = validator.New(validator.WithRequiredStructEnabled())
)

type MarketProvider interface {
	Price(ctx context.Context, instrument invest.InstrumentType, ticker string) (float64, error)
}

type DB interface {
	GetPosition(ctx context.Context, id int64) (pos invest.Position, err error)
	AddPosition(ctx context.Context, pos invest.Position) (id int64, err error)
	PutPosition(ctx context.Context, id int64, pos invest.Position) error
}
