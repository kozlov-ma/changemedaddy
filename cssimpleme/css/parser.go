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
		var classValue string
		var variants []ApplyVariant

		if !strings.HasPrefix(variantsClassValue, "[") {
			variants, classValue = getVariants(variantsClassValue, p)
		}

		if variants == nil {
			continue
		}

		classValue = variantsClassValue

		var class *Class
		var value string

		// FIXME ПОЛНЫЙ ПЭ кастовать в []rune
	out:
		for end := len(classValue); end > 0; end-- {
			className := classValue[:end]
			var possibleValue string
			if end < len(classValue) && classValue[end] == '-' {
				possibleValue = classValue[min(end+1, len(classValue)):]
				if className[0] == '-' {
					possibleValue = "-" + possibleValue
				}
			} else {
				possibleValue = ""
			}

			for _, cl := range p.Cls.Find(className) {
				val, ok := cl.Val.Read(possibleValue)
				if ok {
					class = cl
					value = val
					break out
				} else if strings.HasPrefix(possibleValue, "[") && strings.HasSuffix(possibleValue, "]") {
					class = cl
					value = strings.Trim(possibleValue, "[]")
					break out
				}
			}
		}

		if class == nil {
			p.UnknownClasses <- variantsClassValue
			continue
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

func getVariants(variantsClassValue string, p *Parser) ([]ApplyVariant, string) {
	possibleVariants := strings.Split(variantsClassValue, ":")
	numVariants := len(possibleVariants)

	if numVariants == 0 {
		return nil, ""
	}

	variants := make([]ApplyVariant, 0, numVariants-1)
	for _, v := range possibleVariants[:numVariants-1] {
		if vr, ok := p.Va.Find(v); ok {
			variants = append(variants, vr)
		} else {
			p.UnknownVariants <- variantsClassValue
		}
	}

	return variants, possibleVariants[numVariants-1]
}
