# Fix ESLint errors
$content = Get-Content 'src/app/profile/feedback/page.tsx' -Raw; $content = $content -replace '}  catch \(error\) \{', '} catch (_error) {'; $content = $content -replace 'const handleRateFeedback = async \(feedbackId: string, rating: number\)', 'const handleRateFeedback = async (_feedbackId: string, _rating: number)'; Set-Content 'src/app/profile/feedback/page.tsx' $content; Write-Host 'Fixed feedback page'
