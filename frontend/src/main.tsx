import {createRoot} from 'react-dom/client';
import {App} from './App';
import {ErrorBoundary} from './components/common/ErrorBoundary';
import './styles/tailwind.css';
import './styles/tokens.css';
import './styles/style.css';

const container = document.getElementById('root');
if (!container) {
  throw new Error('Root container element #root not found');
}

const root = createRoot(container);
root.render(<ErrorBoundary><App /></ErrorBoundary>);
