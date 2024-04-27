package web

import (
	_ "embed"
	"github.com/labstack/echo/v4"
	"html/template"
	"io"
)

const (
	PageHTMLFilename      = "index.html"
	ErrorPageHTMLFilename = "error.html"
)

type tmpls struct {
	ts *template.Template
}

func NewTmpls() *tmpls {
	return &tmpls{
		ts: template.Must(template.ParseGlob("web/templates/*.html")),
	}
}

func (t *tmpls) Render(w io.Writer, name string, data interface{}, c echo.Context) error {
	return t.ts.ExecuteTemplate(w, name, data)
}
