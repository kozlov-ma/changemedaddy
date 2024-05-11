package ui

import (
	"changemedaddy/internal/domain/position"
	_ "embed"
	"time"

	"github.com/labstack/echo/v4"
)

type PositionEditForm struct {
	ID int

	AuthorSlug, IdeaSlug string

	Name   string
	Ticker string

	Type string

	TargetHint  string
	PrevTarget  string
	WrongTarget bool

	DeadlineHint  time.Time
	PrevDeadline  string
	WrongDeadline bool
}

func EditPosition(authorSlug, ideaSlug string, p *position.Position) PositionEditForm {
	return PositionEditForm{
		ID:           p.ID,
		AuthorSlug:   authorSlug,
		IdeaSlug:     ideaSlug,
		Name:         p.Instrument.Name,
		Ticker:       p.Instrument.Ticker,
		Type:         string(p.Type),
		TargetHint:   p.TargetPrice.String(),
		DeadlineHint: p.Deadline,
	}
}

func (p PositionEditForm) Render(c echo.Context) error {
	return c.Render(200, "edit_position.html", p)
}
