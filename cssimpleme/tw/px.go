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

	Classes.Functional("ring-offset", px, func(value string) ast.AST {
		return ast.AST{
			ast.Decl("--x3-ring-offset-width", value),
		}
	})

	Classes.Functional("outline-offset", px, func(value string) ast.AST {
		return ast.AST{
			ast.Decl("outline-offset", value),
		}
	})

	Classes.Functional("inset", px, func(value string) ast.AST {
		return ast.AST{
			ast.Decl("inset", value),
		}
	})

	Classes.Functional("inset-x", px, func(value string) ast.AST {
		return ast.AST{
			ast.Decl("left", value),
			ast.Decl("right", value),
		}
	})

	Classes.Static("border-1", ast.Decl("border-width", "1px"))
	Classes.Static("border-2", ast.Decl("border-width", "2px"))
	Classes.Static("border-3", ast.Decl("border-width", "3px"))
	Classes.Static("border-4", ast.Decl("border-width", "4px"))
}
