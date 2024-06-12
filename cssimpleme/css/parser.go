package css

import (
	"cssimpleme/ast"
	"strings"
)

type ClassRegistry interface {
	Find(name string) []*Class
}

type VariantRegistry interface {
	Find(name string) (av ApplyVariant, ok bool)
}

type Parser struct {
	Cls ClassRegistry
	Va  VariantRegistry

	Input  <-chan string
	Output chan<- *ast.Rule

	UnknownVariants chan<- string
	UnknownClasses  chan<- string
	UnknownValues   chan<- string
}

func (p *Parser) Work() {
	defer close(p.Output)
	defer close(p.UnknownClasses)
	defer close(p.UnknownVariants)
	defer close(p.UnknownValues)

	for variantsClassValue := range p.Input {

		possibleVariants := strings.Split(variantsClassValue, ":")
		numVariants := len(possibleVariants)

		if numVariants == 0 {
			return
		}

		variants := make([]ApplyVariant, 0, numVariants-1)
		for _, v := range possibleVariants[:numVariants-1] {
			if vr, ok := p.Va.Find(v); ok {
				variants = append(variants, vr)
			} else {
				p.UnknownVariants <- variantsClassValue
			}
		}

		classValue := possibleVariants[numVariants-1]
		var class *Class
		var value string

		// FIXME ПОЛНЫЙ ПЭ кастовать в []rune
		var found bool

		for end := len(classValue); end > 0; end-- {
			for _, cl := range p.Cls.Find(classValue[:end]) {
				if end == len(classValue) || classValue[end] == '-' {
					class = cl
					if end != len(classValue) {
						cv := classValue[end+1:]
						pv, ok := class.Val.Read(value)
						if !ok {
							if strings.HasPrefix(cv, "[") && strings.HasSuffix(cv, "]") {
								pv = cv[1 : len(cv)-1]
							} else {
								p.UnknownValues <- variantsClassValue + " " + class.Name + " " + pv
								continue
							}
						} else {
							value = pv
						}
					}
					found = true
					break
				}
			}
		}
		if !found {
			p.UnknownClasses <- variantsClassValue
			continue
		}

		if class.Name[0] == '-' {
			value = "-" + value
		}

		parsed := parsed{
			Original: variantsClassValue,
			Class:    class,
			Value:    value,
			Variants: variants,
		}
		p.Output <- parsed.ToRule()
	}
}
