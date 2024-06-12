package css

import "cssimpleme/ast"

type Parser struct {
	Input  <-chan string
	Output chan<- *ast.Rule

	UnknownVariants chan<- string
	UnknownClasses  chan<- string
}

func (p *Parser) Work() {
	panic("implement me")
}
