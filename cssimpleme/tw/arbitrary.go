package tw

import (
	"cssimpleme/ast"
	"strings"
)

type arbReader struct{}

func (a arbReader) Read(fromCls string) (converted string, ok bool) {
	if strings.HasPrefix(fromCls, "[") && strings.HasSuffix(fromCls, "]") {
		return strings.Trim(fromCls, "[]"), ok
	}

	return "", false
}

var arb = arbReader{}

func init() {
	Classes.Functional("aspect", arb, func(value string) ast.AST {
		return ast.AST{
			ast.Decl("aspect-ratio", value),
		}
	})
	Classes.Functional("rotate", arb, func(value string) ast.AST {
		return ast.AST{
			ast.Decl("--x3-rotate", value),
			ast.Decl("transform", "translate(var(--x3-translate-x), var(--x3-translate-y)) rotate(var(--x3-rotate)) skewX(var(--x3-skew-x)) skewY(var(--x3-skew-y)) scaleX(var(--x3-scale-x)) scaleY(var(--x3-scale-y))"),
		}
	})
}
