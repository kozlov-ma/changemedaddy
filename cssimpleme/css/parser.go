package css

import "cssimpleme/ast"

type Parser struct {
	Input  <-chan string
	Output <-chan ast.Rule
}

func (p *Parser) Work() {
	panic("implement me")
}
