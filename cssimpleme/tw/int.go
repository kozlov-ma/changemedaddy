package tw

import (
	"cssimpleme/ast"
	"fmt"
	"strconv"
)

type intReader struct{}

func (in intReader) Read(fromCls string) (converted string, ok bool) {
	i, err := strconv.Atoi(fromCls)
	if err != nil {
		return "", false
	}

	return fmt.Sprintf("%d", i), true
}

var intr = intReader{}

func init() {
	Classes.Functional("grid-cols", intr, func(value string) ast.AST {
		return ast.AST{
			ast.Decl("grid-template-columns", fmt.Sprintf("repeat(%s, minmax(0, 1fr))", value)),
		}
	})

	Classes.Functional("grid-rows", intr, func(value string) ast.AST {
		return ast.AST{
			ast.Decl("grid-template-rows", fmt.Sprintf("repeat(%s, minmax(0, 1fr))", value)),
		}
	})

	Classes.Functional("z", intr, func(value string) ast.AST {
		return ast.AST{
			ast.Decl("z-index", value),
		}
	})

}
