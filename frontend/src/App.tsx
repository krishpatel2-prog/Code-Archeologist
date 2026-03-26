import { useState } from 'react'
import { RootLayout } from './layouts/RootLayout'
import { AnalyzePage } from './pages/AnalyzePage'
import { ModeSelectionPage } from './pages/ModeSelectionPage'
import { DeepViewPage } from './pages/DeepViewPage'
import { useAskChat } from './hooks/useAskChat'
import type { IntelligenceMode } from './types/api'
import { useAnalysis } from './features/analysis/useAnalysis'
import { getProjectName } from './utils/wiki'

type PostAnalyzeView = 'mode-selection' | 'deep-view'

function App() {
  const [postAnalyzeView, setPostAnalyzeView] = useState<PostAnalyzeView>('mode-selection')
  const [activeMode, setActiveMode] = useState<IntelligenceMode>('architecture')

  const analysis = useAnalysis()
  const chat = useAskChat(analysis.jobId)

  return (
    <RootLayout>
      {!analysis.wiki ? (
        <AnalyzePage
          repoInput={analysis.repoInput}
          progress={analysis.progress}
          statusMessage={analysis.statusMessage}
          repoName={analysis.repoName}
          steps={analysis.steps}
          isRunning={analysis.isAnalyzing}
          error={analysis.error}
          onChangeInput={analysis.setRepoInput}
          onAnalyze={analysis.startAnalysis}
          onAnalyzeUploaded={analysis.startUploadedAnalysis}
        />
      ) : null}

      {analysis.wiki && postAnalyzeView === 'mode-selection' ? (
        <ModeSelectionPage
          projectName={getProjectName(analysis.wiki)}
          wiki={analysis.wiki}
          onReset={() => {
            analysis.resetAnalysis()
            chat.clear()
            setPostAnalyzeView('mode-selection')
          }}
          onOpenMode={(mode) => {
            setActiveMode(mode)
            setPostAnalyzeView('deep-view')
          }}
        />
      ) : null}

      {analysis.wiki && postAnalyzeView === 'deep-view' ? (
        <DeepViewPage
          mode={activeMode}
          wiki={analysis.wiki}
          jobId={analysis.jobId}
          messages={chat.messages}
          isTyping={chat.isTyping}
          onAsk={chat.sendMessage}
          onBack={() => setPostAnalyzeView('mode-selection')}
        />
      ) : null}
    </RootLayout>
  )
}

export default App
