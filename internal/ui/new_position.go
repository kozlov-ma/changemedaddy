package ui

import (
	_ "embed"

	"github.com/labstack/echo/v4"
)

type PositionForm struct {
	IdeaID int

	PrevTicker  string
	WrongTicker bool

	PrevTarget  string
	WrongTarget bool

	WrongType bool

	PrevDeadline  string
	WrongDeadline bool
}

func NewPosition(ideaID int) PositionForm {
	return PositionForm{
		IdeaID: ideaID,
	}
}

func (p PositionForm) Render(c echo.Context) error {
	return c.Render(200, "new_position.html", p)
}
