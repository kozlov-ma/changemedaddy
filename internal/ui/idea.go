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

//go:embed template/idea.html
var s_ideaTemplate string
var ideaTemplate = mustTemplate(s_ideaTemplate)

func (ic IdeaComponent) Render(c echo.Context) error {
	return ideaTemplate.Execute(c.Response().Writer, ic)
}
