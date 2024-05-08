package ui

import "github.com/labstack/echo/v4"

type AnalystForm struct {
	PrevName     string
	NameTooLong  bool
	NameTooShort bool
	NameTaken    bool
}

func NewAnalyst() AnalystForm {
	return AnalystForm{}
}

func (a AnalystForm) Render(c echo.Context) error {
	return c.Render(200, "new_analyst.html", a)
}
