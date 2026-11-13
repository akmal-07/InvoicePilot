import { useState } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import CreateInvoice from './pages/CreateInvoice';
import InvoiceDetail from './pages/InvoiceDetail';
import ClientView from './pages/ClientView';

export default function App() {
  const [refreshKey, setRefreshKey] = useState(0);

  const handleReset = () => {
    setRefreshKey((prev) => prev + 1);
  };

  return (
    <BrowserRouter>
      <Layout onReset={handleReset}>
        <Routes>
          <Route path="/" element={<Dashboard refreshKey={refreshKey} />} />
          <Route path="/create" element={<CreateInvoice />} />
          <Route path="/invoice/:id" element={<InvoiceDetail />} />
          <Route path="/client/:id" element={<ClientView />} />
        </Routes>
      </Layout>
    </BrowserRouter>
  );
}
