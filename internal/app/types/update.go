package types

import (
	"net/http"
	"time"

	"github.com/shopspring/decimal"
)

type (
	UpdateKind string

	Update struct {
		ID int64 `json:"id" bson:"_id"`

		CreatedAt time.Time `json:"created_at" bson:"created_at"`

		UpdateKind UpdateKind `json:"update_kind"`

		Delta          int             `json:"delta,omitempty" bson:"delta,omitempty"`
		Price          decimal.Decimal `json:"price,omitempty" bson:"price,omitempty"`
		NewDeadline    time.Time       `json:"new_deadline,omitempty" bson:"new_deadline,omitempty"`
		NewTargetPrice decimal.Decimal `json:"new_target_price,omitempty" bson:"new_target_price,omitempty"`
	}
)

const (
	Transaction UpdateKind = "transaction"
	Deadline    UpdateKind = "deadline"
	Target      UpdateKind = "target"
)

func (u *Update) Apply(p *Position) (*Position, error) {
	switch u.UpdateKind {
	case Transaction:
		return u.applyTx(p)
	case Deadline:
		return u.applyDeadline(p)
	case Target:
		return u.applyTarget(p)
	default:
		panic("unknown update type")
	}
}

func (u *Update) applyTx(p *Position) (*Position, error) {
	p = p.Clone()

	switch {
	case p.Type == Long && u.Delta > 0 || p.Type == Short && u.Delta < 0:
		p.Lots = append(p.Lots, Lot{OpenDate: u.CreatedAt, Amount: u.Delta, Price: u.Price})
	case p.Type == Long && u.Delta < 0 || p.Type == Short && u.Delta > 0:
		left := abs(u.Delta)
		zeroedLots := 0
		for _, lot := range p.Lots {
			if lot.Amount > left {
				lot.Amount -= left
				break
			} else {
				left -= lot.Amount
				lot.Amount = 0
				zeroedLots++
			}
		}

		if left > 0 {
			return nil, ErrCannotFlipPosition
		}

		p.Lots = p.Lots[zeroedLots:]
	default:
		panic("applyTx is implemented incorrectly")
	}

	return p, nil
}

func (u *Update) applyDeadline(p *Position) (*Position, error) {
	if time.Now().After(u.NewDeadline) {
		return nil, ErrDeadlinePassed
	}

	p = p.Clone()
	p.Deadline = u.NewDeadline
	return p, nil
}

func (u *Update) applyTarget(p *Position) (*Position, error) {
	p = p.Clone()
	if !p.TargetPrice.IsPositive() {
		return nil, ErrNonPositivePrice
	}
	p.TargetPrice = u.NewTargetPrice
	return p, nil
}

func abs(a int) int {
	if a < 0 {
		return -a
	}
	return a
}

func (u Update) Render(w http.ResponseWriter, r *http.Request) error {
	return nil
}
