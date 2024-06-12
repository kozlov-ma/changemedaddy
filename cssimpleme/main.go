package main

import (
	"cssimpleme/ast"
	"cssimpleme/css"
	"fmt"
	"io/fs"
	"os"
	"path/filepath"
	"regexp"
	"strings"
	"sync"

	"github.com/charmbracelet/log"
)

func paths() <-chan string {
	pp := make(chan string, 100)
	go func() {
		defer close(pp)

		filepath.WalkDir("..", func(path string, d fs.DirEntry, err error) error {
			if err != nil {
				log.Error("error when walking directory", "err", err)
				return err
			}
			if !d.IsDir() && strings.HasSuffix(d.Name(), ".html") {
				pp <- path
			}

			return nil
		})
	}()

	return pp
}

var classRegex = regexp.MustCompile(`class="([^"]+)"`)

func classes(htmlPaths <-chan string) <-chan string {
	cc := make(chan string, 100)
	go func() {
		defer close(cc)

		var wg sync.WaitGroup
		for p := range htmlPaths {
			wg.Add(1)
			go func(p string) {
				defer wg.Done()

				data, err := os.ReadFile(p)
				if err != nil {
					log.Error("error when reading file", "file", p, "err", err)
					return
				}

				matches := classRegex.FindAllStringSubmatch(string(data), -1)
				for _, m := range matches {
					for _, mm := range strings.Split(m[1], " ") {
						cc <- mm
					}
				}
			}(p)
		}

		wg.Wait()
	}()

	return cc
}

func main() {
	log.SetLevel(log.DebugLevel)
	log.SetOutput(os.Stderr)

	cls := css.NewClasses()

	cls.Functional("mx", css.Rem, func(value string) ast.AST {
		return ast.AST{ast.Decl("margin-left", value), ast.Decl("margin-right", value)}
	})

	va := css.NewVariants()
	va.PseudoClass("hover")

	va.Selector("lg", "@media (min-width: 1024px)")

	out := make(chan *ast.Rule, 228)

	unknownVariants := make(chan string, 250)
	unknownClasses := make(chan string, 250)
	parser := css.Parser{
		Cls:             cls,
		Va:              va,
		Input:           classes(paths()),
		Output:          out,
		UnknownVariants: unknownVariants,
		UnknownClasses:  unknownClasses,
	}

	var wg sync.WaitGroup

	wg.Add(4)

	go func() {
		defer wg.Done()
		parser.Work()
	}()

	var sb strings.Builder
	go func() {
		defer wg.Done()
		for ru := range out {
			sb.WriteString(ru.CSS())
			sb.WriteString("\n\n")
			log.Debug("parsed", "css", ru.CSS())
		}
	}()

	go func() {
		defer wg.Done()
		for uv := range unknownVariants {
			log.Error("unknown variant", "class", uv)
		}
	}()

	go func() {
		defer wg.Done()
		for uc := range unknownClasses {
			log.Warn("unknown class", "class", uc)
		}
	}()

	wg.Wait()

	fmt.Println(sb.String())
}
