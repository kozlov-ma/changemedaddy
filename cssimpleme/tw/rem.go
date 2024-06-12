package tw

import (
	"cssimpleme/ast"
	"strconv"
)

type remReader struct{}

func (r remReader) Read(fromCls string) (converted string, ok bool) {
	f, err := strconv.ParseFloat(fromCls, 64)
	if err != nil {
		return "", false
	}

	return strconv.FormatFloat(f/4, 'f', 3, 64) + "rem", true
}

var rem = remReader{}

func remClass(name string, propertyNames ...string) {
	Classes.Functional(name, rem, func(value string) ast.AST {
		var a ast.AST
		for _, pn := range propertyNames {
			a = append(a, ast.Decl(pn, value))
		}
		return a
	})
}

func init() {
	remClass("top", "top")
	remClass("left", "left")
	remClass("right", "right")
	remClass("bottom", "bottom")

	remClass("mx", "margin-left", "margin-right")

	remClass("mb", "margin-bottom")
	remClass("mr", "margin-right")
	remClass("ml", "margin-left")
	remClass("mt", "margin-top")

	remClass("h", "height")
	remClass("min-h", "min-height")

	remClass("w", "width")

	remClass("gap", "gap")

	remClass("gap-x", "-moz-column-gap", "column-gap")

	remClass("gap-y", "row-gap")

	remClass("p", "padding")
	remClass("px", "padding-left", "padding-right")
	remClass("py", "padding-top", "padding-bottom")

	remClass("pr", "padding-right")
	remClass("pl", "padding-left")
	remClass("pt", "padding-top")
	remClass("pb", "padding-bottom")

	remClass("leading", "line-height")
}
