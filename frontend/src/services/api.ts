import axios from "axios";

// Instanciar a origem das rquisições para a api
const api = axios.create({
  baseURL: "http://localhost:3000",
});

// TODO: Criar funções utilitárias para os métodos http: POST, GET e etc

// Adiciona token de acesso no header das requisições
api.interceptors.request.use((config) => {
  const token = localStorage.getItem("accessToken");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  return config;
});

// TODO: Desenvolver um interceptor para ver se tem o accessToken atualizado no response, para então colocá-lo na memória da aplicação e apagar da response. Isso é bom pq ele consegue fazer todo esse processo em uma request e não levaria mais tempo para fazer isso

export default api;