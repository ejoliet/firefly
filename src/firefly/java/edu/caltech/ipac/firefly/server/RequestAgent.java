/*
 * License information at https://github.com/Caltech-IPAC/firefly/blob/master/License.txt
 */
package edu.caltech.ipac.firefly.server;

import edu.caltech.ipac.firefly.data.userdata.UserInfo;
import edu.caltech.ipac.firefly.server.security.JOSSOAdapter;
import edu.caltech.ipac.firefly.server.util.Logger;
import edu.caltech.ipac.util.StringUtils;

import javax.servlet.http.Cookie;
import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.net.MalformedURLException;
import java.net.URL;
import java.util.Enumeration;
import java.util.HashMap;
import java.util.Map;

/**
 * Date: 4/20/15
 * This class acts as an agent for the underlaying request.  A request can initiate from different sources.
 * In this case, it can be HTTP, WS, or POJO.
 *
 * It also handle authentication related functions
 *
 * @author loi
 * @version $Id: $
 */
public class RequestAgent {

    private Map<String, String> cookies;
    private String requestUrl;      // the request url
    private String baseUrl;         // the url up to the the app's path
    private String hostUrl;         // the url up to the host name including port
    private String remoteIP;
    private String sessId;
    private String contextPath;

    public RequestAgent() {}

    public RequestAgent(Map<String, String> cookies, String hostUrl, String requestUrl, String baseUrl, String remoteIP, String sessId, String contextPath) {
        this.cookies = cookies;
        this.requestUrl = requestUrl;
        this.baseUrl = baseUrl;
        this.remoteIP = remoteIP;
        this.sessId = sessId;
        this.contextPath = contextPath;
    }

    public void setCookies(Map<String, String> cookies) {
        this.cookies = cookies;
    }

    public Map<String, String> getCookies() {
        if (cookies == null) {
            cookies = extractCookies();
        }
        return cookies;
    }

    public String getSessId() {
        return sessId;
    }

    void setSessId(String sessId) {
        this.sessId = sessId;
    }

    public String getContextPath() { return contextPath; }
    void setContextPath(String contextPath) { this.contextPath = contextPath; };

    public String getHostUrl() { return hostUrl;}

    void setHostUrl(String hostUrl) { this.hostUrl = hostUrl;}

    public String getRequestUrl() {
        return requestUrl;
    }

    void setRequestUrl(String requestUrl) {
        this.requestUrl = requestUrl;
    }

    public String getBaseUrl() { return baseUrl; }

    void setBaseUrl(String baseUrl) {
        this.baseUrl = baseUrl;
    }

    public String getRemoteIP() {
        return remoteIP;
    }

    void setRemoteIP(String remoteIP) {
        this.remoteIP = remoteIP;
    }

    public void sendCookie(Cookie cookie) {}

    String getCookie(String name) {
        return getCookies().get(name);
    }

    public String getRealPath(String relPath) {
        return null;
    }

    public String getHeader(String name) {
        return getHeader(name, null);
    }

    public String getHeader(String name, String def) {
        return null;
    }

    public void sendRedirect(String url) {}

    protected Map<String, String> extractCookies() {
        return new HashMap<>(0);
    }


//====================================================================
//  Authentication section
//====================================================================
    public String getAuthKey() { return null; }
    public String getAuthToken() { return null;}
    public UserInfo getUserInfo() { return null; }
    public void clearAuthInfo() {}
    public Map<String, String> getIdentities() { return null; }
    public void updateAuthInfo(String authToken) {}


//====================================================================
//  RequestAgent implementations...
//====================================================================

    public static class HTTP extends RequestAgent {
        public static String AUTH_KEY = "JOSSO_SESSIONID";
        public static String TO_BE_DELETE = "-";
        private static final Logger.LoggerImpl LOG = Logger.getLogger();
        private HttpServletRequest request;
        private HttpServletResponse response;
        private static final String[] ID_COOKIE_NAMES = new String[]{AUTH_KEY, "ISIS"};

        public HTTP(HttpServletRequest request, HttpServletResponse response) {
            this.request = request;
            this.response = response;

            // getting the base url including the application path is a bit tricky when behind reverse proxy(ies)
            URL referer = null;

            try {
                String url = getHeader("Referer", getHeader("Origin"));
                referer = new URL(url);
            } catch (MalformedURLException e) {}

            String proto = referer != null ? referer.getProtocol() : getHeader("X-Forwarded-Proto", request.getScheme());
            String host  = referer != null ? referer.getHost()     : getHeader("X-Forwarded-Server", getHeader("X-Forwarded-Host", request.getServerName()));
            String port  = referer != null && referer.getPort() > 0 ? referer.getPort()+""  : getHeader("X-Forwarded-Port", String.valueOf(request.getServerPort()));
            port = port.matches("443|80") ? "" : ":" + port;

            String contextPath = getHeader("X-Forwarded-Path");
            if (contextPath == null && referer != null) {
                contextPath = referer.getPath();
                int idx = contextPath.lastIndexOf("/");
                if (idx > 0) {
                    contextPath = contextPath.substring(0, idx);
                }
            }
            if (StringUtils.isEmpty(contextPath)) {
                contextPath = request.getContextPath();
            }

            String hostUrl = String.format("%s://%s%s", proto, host, port);
            String baseUrl = hostUrl + contextPath;
            baseUrl = baseUrl.endsWith("/") ? baseUrl :  baseUrl + "/";

            String requestUrl =  getHeader("X-Original-URI");
            if (requestUrl == null) {
                String queryStr = request.getQueryString() == null ? "" : "?" + request.getQueryString();
                String path = request.getRequestURI();
                if (!contextPath.equals(request.getContextPath())) {
                    path = path.replace(request.getContextPath(), contextPath);
                }
                requestUrl = path + queryStr;
            }
            requestUrl = requestUrl.startsWith(proto) ? requestUrl : hostUrl + requestUrl;

            String remoteIP = getHeader("x-original-forwarded-for", getHeader("X-Forwarded-For", request.getRemoteAddr()));

            setBaseUrl(baseUrl);
            setHostUrl(hostUrl);
            setRequestUrl(requestUrl);
            setContextPath(contextPath);
            setRemoteIP(remoteIP);
            setSessId(request.getSession(true).getId());

            /*
            LOG.info("baseUrl: " + baseUrl);
            LOG.info("hostUrl: " + hostUrl);
            LOG.info("requestUrl: " + requestUrl);
            LOG.info("contextPath: " + contextPath);
            LOG.info("remoteIP: " + remoteIP);
             */
        }

        @Override
        protected Map<String, String> extractCookies() {
            HashMap<String, String> cookies = new HashMap<>();
            if (request != null) {
                if (request.getCookies() != null) {
                    for (javax.servlet.http.Cookie c : request.getCookies()) {
                        cookies.put(c.getName(), c.getValue());
                    }
                }
            }
            return cookies;
        }

        @Override
        public String getRealPath(String relPath) {
            return response != null ? request.getRealPath(relPath) : null;
        }

        @Override
        public void sendCookie(Cookie cookie) {
            if (response != null) {
                response.addCookie(cookie);
            }
        }

        @Override
        public String getHeader(String name, String def) {
            if (request != null) {
                String retval = request.getHeader(name);
                retval = retval == null ? request.getHeader(name.toLowerCase()) : retval;
            return StringUtils.isEmpty(retval) ? def : retval;
            } else {
                return def;
            }
        }

        @Override
        public void sendRedirect(String url) {
            try {
                response.sendRedirect(url);
            } catch (IOException e) {
                LOG.error(e, "Unable to redirect to:" + url);
            }
        }

        //====================================================================
        //  Authentication section
        //====================================================================

        @Override
        public String getAuthKey() {
            return AUTH_KEY;
        }

        @Override
        public Map<String, String> getIdentities() {
            HashMap<String, String> idCookies = new HashMap<String, String>();
            for (String name : ID_COOKIE_NAMES) {
                String value = getCookie(name);
                if (!StringUtils.isEmpty(value)) {
                    idCookies.put(name, value);
                }
            }
            return idCookies.size() == 0 ? null : idCookies;
        }

        @Override
        public UserInfo getUserInfo() {
            String authToken = getAuthToken();
            return StringUtils.isEmpty(authToken) ? null :
                    JOSSOAdapter.getUserInfo(authToken);
        }

        @Override
        public String getAuthToken() {
            return getCookie(AUTH_KEY);
        }

        @Override
        public void updateAuthInfo(String authToken) {
            Cookie c = new Cookie(AUTH_KEY, authToken);
            c.setMaxAge(authToken == null ? 0 : 60 * 60 * 24 * 14);
            c.setValue(authToken);
            c.setPath("/");
            sendCookie(c);

        }

        @Override
        public void clearAuthInfo() {
            if (getAuthToken() != null) {
                Cookie c = new Cookie(AUTH_KEY, "");
                c.setMaxAge(0);
                c.setValue(TO_BE_DELETE);
                c.setDomain("ipac.caltech.edu");
                c.setPath("/");
                sendCookie(c);
            }
        }
    }
}
