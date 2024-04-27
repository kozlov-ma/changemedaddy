package ui

import (
	_ "embed"

	"changemedaddy/internal/aggregate/idea"

	"github.com/labstack/echo/v4"
)

type IdeaComponent struct {
	ID   int
	Name string

	AuthorName string

	SourceLink string

	PositionIDs []int
}

func Idea(i *idea.Idea) IdeaComponent {
	return IdeaComponent{
		ID:          i.ID,
		Name:        i.Name,
		AuthorName:  i.AuthorName,
		SourceLink:  i.SourceLink,
		PositionIDs: i.PositionIDs,
	}
}

func (i IdeaComponent) Render(c echo.Context) error {
	return c.Render(200, "idea.html", i)
}
