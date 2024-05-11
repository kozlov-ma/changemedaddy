package ui

import (
	_ "embed"
	"strings"
	"time"

	"changemedaddy/internal/domain/position"

	"github.com/greatcloak/decimal"
	"github.com/labstack/echo/v4"
)

type PositionComponent struct {
	ID        int
	Ticker    string
	AssetName string
	Type      string

	AuthorSlug, IdeaSlug string

	Profitable bool
	ProfitP    string

	IsClosed   bool
	ClosePrice decimal.Decimal

	OpenPrice decimal.Decimal
	CurPrice  decimal.Decimal

	TargetPrice decimal.Decimal
	Change      string
	ChangeP     string
	ChangeUp    bool

	Deadline time.Time
	OpenDate time.Time

	IsOwner bool
}

func Position(isOwner bool, authorSlug, ideaSlug string, p position.WithProfit) PositionComponent {
	var change, changeP string
	if p.Status == position.Active {
		change = withSign(p.TargetPrice.Sub(p.Instrument.Price))
		changeP = withSign(p.TargetPrice.Sub(p.Instrument.Price).Div(p.Instrument.Price).Mul(decimal.NewFromInt(100)).Round(2))
	} else if p.Status == position.Closed {
		change = withSign(p.ClosedPrice.Sub(p.OpenPrice))
		changeP = withSign(p.ClosedPrice.Sub(p.OpenPrice).Div(p.OpenPrice).Mul(decimal.NewFromInt(100)).Round(2))
	}

	return PositionComponent{
		ID:        p.ID,
		Ticker:    strings.ToUpper(p.Instrument.Ticker),
		Type:      strings.ToUpper(string(p.Type)),
		AssetName: p.Instrument.Name,

		AuthorSlug: authorSlug,
		IdeaSlug:   ideaSlug,

		Profitable: p.ProfitP.GreaterThanOrEqual(decimal.Zero),
		ProfitP:    withSign(p.ProfitP),

		IsClosed:   p.Status == position.Closed,
		ClosePrice: p.ClosedPrice,

		OpenPrice: p.OpenPrice,
		CurPrice:  p.Instrument.Price,

		TargetPrice: p.TargetPrice,
		Change:      change,
		ChangeP:     changeP,

		Deadline: p.Deadline,
		OpenDate: p.OpenDate,

		IsOwner: isOwner,
	}
}

func (pc PositionComponent) Render(c echo.Context) error {
	return c.Render(200, "position.html", pc)
}
