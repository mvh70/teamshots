# Page snapshot

```yaml
- generic [ref=e1]:
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
            - textbox "Email address" [active] [ref=e19]
          - generic [ref=e20]:
            - generic [ref=e21]: Password
            - generic [ref=e22]:
              - textbox "Password" [ref=e23]
              - button "Show password" [ref=e24] [cursor=pointer]: 👁️ Show
          - generic [ref=e25]:
            - generic [ref=e26]:
              - checkbox "Use magic link instead of password" [ref=e27]
              - text: Use magic link instead of password
            - link "Forgot password?" [ref=e28]:
              - /url: "#"
          - button "Sign in" [ref=e29] [cursor=pointer]
          - link "Don't have an account? Sign up" [ref=e31]:
            - /url: /auth/signup
  - button "Open Next.js Dev Tools" [ref=e37] [cursor=pointer]:
    - img [ref=e38]
  - alert [ref=e43]
```