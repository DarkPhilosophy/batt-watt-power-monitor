const rule = {
    meta: {
        type: 'layout',
        docs: {
            description: 'Remove decorative dashes and list numbers from comments',
        },
        fixable: 'whitespace',
        schema: [],
    },
    create(context) {
        const sourceCode = context.sourceCode;
        return {
            Program() {
                const comments = sourceCode.getAllComments();
                comments.forEach(comment => {
                    const value = comment.value;
                    let newValue = value;

                    const startRegex = /^(\s*)(?:-+|\d+\.)\s+(.*)$/s;

                    const matchStart = newValue.match(startRegex);
                    if (matchStart) {
                        newValue = matchStart[1] + matchStart[2];
                    }

                    const endRegex = /^(.*?)(\s*-+)$/s;
                    const matchEnd = newValue.match(endRegex);
                    if (matchEnd) {
                        newValue = matchEnd[1];
                    }

                    if (newValue !== value) {
                        context.report({
                            node: null,
                            loc: comment.loc,
                            message: 'Comment contains decorative characters or numbering.',
                            fix(fixer) {
                                let finalComment;
                                if (comment.type === 'Line') {
                                    finalComment = `//${newValue}`;
                                } else {
                                    finalComment = `/*${newValue}*/`;
                                }
                                return fixer.replaceText(comment, finalComment);
                            },
                        });
                    }
                });
            },
        };
    },
};

module.exports = rule;
