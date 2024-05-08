package ui

import (
	_ "embed"

	"changemedaddy/internal/aggregate/idea"

	"github.com/labstack/echo/v4"
)

type IdeaComponent struct {
	ID   int
	Name string
	Slug string

	AuthorName string
	AuthorSlug string

	SourceLink string

	PositionIDs []int

	IsActive bool
}

func Idea(i *idea.Idea) IdeaComponent {
	return IdeaComponent{
		ID:          i.ID,
		Name:        i.Name,
		Slug:        i.Slug,
		AuthorName:  i.AuthorName,
		AuthorSlug:  i.AuthorSlug,
		SourceLink:  i.SourceLink,
		PositionIDs: i.PositionIDs,
		IsActive:    i.Status == idea.Active,
	}
}

func (i IdeaComponent) Render(c echo.Context) error {
	return c.Render(200, "idea.html", i)
}
