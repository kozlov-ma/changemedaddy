package update

import (
	"net/http"
	"time"

	"github.com/shopspring/decimal"

	"changemedaddy/internal/app/position"
)

type (
	Type string

	// An Update represents a change that the owner of the position.Position makes
	// to it while it is still open.
	Update struct {
		// ID is a unique identifier for the Update.
		ID int64 `json:"ID"`

		// Type is a type of the Update.
		Type Type `json:"type"`

		// For TypeTx: Delta is the number of securities bought or sold.
		Delta int `json:"delta,omitempty"`
		// For TypeTx: Price is the price at which the securities in this Update were bought or sold.
		Price decimal.Decimal `json:"price,omitempty"`

		// For TypeDeadline: NewDeadline is a new deadline for the Position.
		NewDeadline time.Time `json:"newDeadline,omitempty"`

		// For TypeTarget: NewTargetPrice is a new target price for the Position.
		NewTargetPrice decimal.Decimal `json:"newTargetPrice,omitempty"`
	}
)

const (
	TypeTx       Type = "transaction"
	TypeDeadline Type = "deadline"
	TypeTarget   Type = "target"
)

func (u *Update) Apply(p *position.Position) (*position.Position, error) {
	switch u.Type {
	case TypeTx:
		return u.applyTx(p)
	case TypeDeadline:
		return u.applyDeadline(p)
	case TypeTarget:
		return u.applyTarget(p)
	default:
		panic("unknown update type")
	}
}

func (u *Update) applyTx(p *position.Position) (*position.Position, error) {
	p = p.Clone()

	switch {
	case p.Type == position.TypeLong && u.Delta > 0 || p.Type == position.TypeShort && u.Delta < 0:
		p.Lots = append(p.Lots, position.Lot{Amount: u.Delta, Price: u.Price})
	case p.Type == position.TypeLong && u.Delta < 0 || p.Type == position.TypeShort && u.Delta > 0:
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

func (u *Update) applyDeadline(p *position.Position) (*position.Position, error) {
	if time.Now().After(u.NewDeadline) {
		return nil, ErrDeadlinePassed
	}

	p = p.Clone()
	p.Deadline = u.NewDeadline
	return p, nil
}

func (u *Update) applyTarget(p *position.Position) (*position.Position, error) {
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
