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
	HasSource  bool

	PositionIDs []int

	IsActive bool

	IsOwner bool
}

func Idea(i *idea.Idea, isOwner bool) IdeaComponent {
	return IdeaComponent{
		Name:        i.Name,
		Slug:        i.Slug,
		AuthorName:  i.AuthorName,
		AuthorSlug:  i.AuthorSlug,
		SourceLink:  i.SourceLink,
		HasSource:   len(i.SourceLink) > 0,
		PositionIDs: i.PositionIDs,
		IsActive:    i.Status == idea.Active,
		IsOwner:     isOwner,
	}
}

func (i IdeaComponent) Render(c echo.Context) error {
	return c.Render(200, "idea.html", i)
}
