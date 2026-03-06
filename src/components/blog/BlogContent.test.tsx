import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import BlogContent from './BlogContent'

jest.mock('./BlogCard', () => ({
  __esModule: true,
  default: ({ post }: { post: { slug: string; title?: string } }) => (
    <a href={`/blog/${post.slug}`}>{post.title ?? post.slug}</a>
  ),
}))

jest.mock('./FeaturedPost', () => ({
  __esModule: true,
  default: ({ post }: { post: { slug: string; title?: string } }) => (
    <a href={`/blog/${post.slug}`}>Featured {post.title ?? post.slug}</a>
  ),
}))

jest.mock('./CategoryTabs', () => ({
  __esModule: true,
  default: () => <div>Category tabs</div>,
}))

jest.mock('./BlogCTA', () => ({
  __esModule: true,
  default: () => <div>CTA</div>,
}))

const posts = [
  {
    slug: 'first-post',
    title: 'First post',
    description: 'First description',
    category: 'guides',
    allowedVariants: ['teamshotspro'],
    featured: true,
  },
  {
    slug: 'second-post',
    title: 'Second post',
    description: 'Second description',
    category: 'guides',
    allowedVariants: ['teamshotspro'],
  },
] as const

describe('BlogContent', () => {
  beforeEach(() => {
    window.history.replaceState(null, '', '/')
  })

  it('syncs the search query with the URL using a null history state', async () => {
    const replaceStateSpy = jest.spyOn(window.history, 'replaceState')

    render(
      <BlogContent
        posts={[...posts]}
        title="Blog"
        description="Description"
      />
    )

    const searchInput = screen.getByRole('searchbox')
    fireEvent.change(searchInput, { target: { value: 'team' } })

    await waitFor(() => {
      expect(replaceStateSpy).toHaveBeenCalledWith(
        null,
        '',
        `${window.location.pathname}?q=team`
      )
    })

    replaceStateSpy.mockRestore()
  })
})
