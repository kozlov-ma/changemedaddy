package tw

import (
	"cssimpleme/ast"
	"fmt"
	"strconv"
)

type pxReader struct{}

func (p pxReader) Read(fromCls string) (converted string, ok bool) {
	i, err := strconv.Atoi(fromCls)
	if err != nil {
		return "", false
	}

	return fmt.Sprintf("%dpx", i), true
}

var px = pxReader{}

func init() {
	Classes.Functional("ring", px, func(value string) ast.AST {
		return ast.AST{
			ast.Decl("--x3-ring-offset-shadow", "var(--x3-ring-inset) 0 0 0 var(--x3-ring-offset-width) var(--x3-ring-offset-color)"),
			ast.Decl("--x3-ring-shadow", fmt.Sprintf("var(--x3-ring-inset) 0 0 0 calc(%s + var(--x3-ring-offset-width)) var(--x3-ring-color)", value)),
			ast.Decl("box-shadow", "var(--x3-ring-offset-shadow), var(--x3-ring-shadow), var(--x3-shadow, 0 0 #0000)"),
		}
	})

	Classes.Functional("outline-offset", px, func(value string) ast.AST {
		return ast.AST{
			ast.Decl("outlone-offset", value),
		}
	})
}
