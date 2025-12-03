import { CLIENT_PACKAGES } from '../src/domain/style/packages'
import { PackageConfigSchema } from '../src/domain/style/packagesSchema'

console.log('Validating style packages...')

let hasError = false

Object.values(CLIENT_PACKAGES).forEach(pkg => {
  // We only validate the fields covered by the schema
  // The ClientStylePackage interface has functions which Zod can't easily validate without extensive schema work
  // So we validate the data structure parts
  const result = PackageConfigSchema.safeParse(pkg)
  
  if (!result.success) {
    console.error(`❌ Package ${pkg.id} is invalid:`)
    console.error(JSON.stringify(result.error.issues, null, 2))
    hasError = true
  } else {
    // Additional custom checks
    if (!pkg.visibleCategories || pkg.visibleCategories.length === 0) {
      console.error(`❌ Package ${pkg.id} has empty visibleCategories`)
      hasError = true
    } else {
      console.log(`✅ Package ${pkg.id} is valid`)
    }
  }
})

if (hasError) {
  process.exit(1)
}

console.log('All packages valid!')

