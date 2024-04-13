package position

import (
	"net/http"
	"slices"
	"time"

	"github.com/shopspring/decimal"
)

type (
	Type string

	// Lot represents a single purchase or sale of a security.
	Lot struct {
		// Amount is the number of securities bought or sold.
		Amount int `json:"amount"`
		// Price is the price at which the securities in this Lot were bought or sold.
		Price decimal.Decimal `json:"price"`
	}

	// A Position represents a position on the security market. Essentially, it
	// describes what was bought, how many, when, and what changes were made since then.
	Position struct {
		// ID is a unique identifier for the Position. Must be assigned by a Repository.
		ID string
		// Who this Position belongs to.
		CreatedByID string `json:"createdByID"`
		// A Slug is a unique (within one creator) identifier for the Position.
		Slug string `json:"slug"`
		// A Ticker is a string code for the security (only shares(stocks) are supported!), like YNDX, GAZP.
		Ticker string `json:"ticker"`
		// Type tells whether a position is long or short.
		// CHECK WIKIPEDIA IF YOU DON'T KNOW WHAT ARE THESE.
		Type Type `json:"type"`
		// TargetPrice is a price at which the author of the idea intends to close this position.
		TargetPrice decimal.Decimal `json:"targetPrice"`
		// Lots represents all the lots in a position, in chronological order.
		Lots []Lot `json:"lots"`
		// CreatedAt is a date and time when the Position was created.
		CreatedAt time.Time `json:"createdAt"`
		// Author usually intends to close the Position before Deadline.
		Deadline time.Time `json:"deadline"`
	}
)

func (p *Position) Render(w http.ResponseWriter, r *http.Request) error {
	return nil
}

func (p *Position) Clone() *Position {
	if p == nil {
		return nil
	}

	copied := *p
	cpy := &copied
	cpy.Lots = slices.Clone(p.Lots)
	return cpy
}

const (
	TypeLong  Type = "long"
	TypeShort Type = "short"
)
