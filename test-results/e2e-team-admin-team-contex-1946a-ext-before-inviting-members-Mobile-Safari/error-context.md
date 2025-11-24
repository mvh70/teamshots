# Page snapshot

```yaml
- generic [active] [ref=e1]:
  - generic [ref=e2]:
    - banner [ref=e3]:
      - link "TeamShotsPro" [ref=e5]:
        - /url: /
        - img "TeamShotsPro" [ref=e6]
    - main [ref=e7]:
      - generic [ref=e11]:
        - heading "Sign in to your account" [level=2] [ref=e13]
        - generic [ref=e15]:
          - generic [ref=e16]:
            - generic [ref=e17]: Email address
            - textbox "Email address" [ref=e19]: team-context-1763557704945-3mcbaft1q@example.com
          - generic [ref=e20]:
            - generic [ref=e21]: Password
            - generic [ref=e22]:
              - textbox "Password" [ref=e23]: TestPassword123!
              - button "Show password" [ref=e24] [cursor=pointer]: 👁️ Show
          - generic [ref=e25]:
            - generic [ref=e26]:
              - checkbox "Use magic link instead of password" [ref=e27]
              - text: Use magic link instead of password
            - link "Forgot password?" [ref=e28]:
              - /url: "#"
          - paragraph [ref=e32]: Those credentials don't look right. Double-check your email and password, or try resetting your password.
          - button "Sign in" [ref=e33] [cursor=pointer]
          - link "Don't have an account? Sign up" [ref=e35]:
            - /url: /auth/signup
  - button "Open Next.js Dev Tools" [ref=e41] [cursor=pointer]:
    - img [ref=e42]
  - alert [ref=e47]
```