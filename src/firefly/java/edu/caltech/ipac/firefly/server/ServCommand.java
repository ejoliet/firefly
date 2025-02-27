package edu.caltech.ipac.firefly.server;

import edu.caltech.ipac.firefly.core.EndUserException;
import edu.caltech.ipac.firefly.server.query.DataAccessException;
import org.json.simple.JSONArray;
import org.json.simple.JSONObject;
import edu.caltech.ipac.firefly.server.util.Logger;
import javax.servlet.ServletOutputStream;
import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;

/**
 * Date: 10/24/16
 *
 * @version $Id: $
 */
public abstract class ServCommand extends ServerCommandAccess.HttpCommand {

    private static final Logger.LoggerImpl _log = Logger.getLogger();

    @Override
    public void processRequest(HttpServletRequest req, HttpServletResponse res, SrvParam sp) throws Exception {
        JSONObject json=new JSONObject();
        String jsonData;
        try {
            String result = doCommand(new SrvParam(sp.getParamMap()));

            if (getCanCreateJson()) {
                jsonData = result;
            } else {
                json.put("success", "true");
                json.put("data", result);
                //make it size=1 array since the UI side expects an array
                jsonData = makeOneEntryArray(json);
            }
        } catch (Exception e) {
            _log.error(e, e.getMessage());

            String[] errorCause = getErrorCause(e);

            json.put("success", "false");
            json.put("error", errorCause[0]);
            if (errorCause[1] != null) json.put("cause1", errorCause[1] );   // kept cause1 for backward compatibility
            //make it size=1 array since the UI side expects an array
            jsonData= makeOneEntryArray(json);
        }

        res.setContentType("application/json");
        res.setContentLength(jsonData.length());
        ServletOutputStream out = res.getOutputStream();
        out.write(jsonData.getBytes());
        out.close();
    }

    public boolean getCanCreateJson() { return true; }
    public abstract String doCommand(SrvParam params) throws Exception;

    private static String makeOneEntryArray(JSONObject entry) {
        JSONArray jArray = new JSONArray();
        jArray.add(entry);
        return jArray.toJSONString();
    }

    /**
     * @param e
     * @return the error message of the exception plus the root cause, if it exists.
     */
    public static String[] getErrorCause(Exception e) {
        String cause = null;
        for (Throwable t = e.getCause(); (t != null); t = t.getCause()) {
            String type = t instanceof EndUserException ? DataAccessException.class.getSimpleName() : t.getClass().getSimpleName();     // need to clean this up at some point
            cause = t.getMessage().contains(":") ? t.getMessage() : type + ": " + t.getMessage();
        }
        return new String[]{e.getMessage(), cause};
    }
}






/*
* THIS SOFTWARE AND ANY RELATED MATERIALS WERE CREATED BY THE CALIFORNIA
* INSTITUTE OF TECHNOLOGY (CALTECH) UNDER A U.S. GOVERNMENT CONTRACT WITH
* THE NATIONAL AERONAUTICS AND SPACE ADMINISTRATION (NASA). THE SOFTWARE
* IS TECHNOLOGY AND SOFTWARE PUBLICLY AVAILABLE UNDER U.S. EXPORT LAWS
* AND IS PROVIDED AS-IS TO THE RECIPIENT WITHOUT WARRANTY OF ANY KIND,
* INCLUDING ANY WARRANTIES OF PERFORMANCE OR MERCHANTABILITY OR FITNESS FOR
* A PARTICULAR USE OR PURPOSE (AS SET FORTH IN UNITED STATES UCC 2312-2313)
* OR FOR ANY PURPOSE WHATSOEVER, FOR THE SOFTWARE AND RELATED MATERIALS,
* HOWEVER USED.
*
* IN NO EVENT SHALL CALTECH, ITS JET PROPULSION LABORATORY, OR NASA BE LIABLE
* FOR ANY DAMAGES AND/OR COSTS, INCLUDING, BUT NOT LIMITED TO, INCIDENTAL
* OR CONSEQUENTIAL DAMAGES OF ANY KIND, INCLUDING ECONOMIC DAMAGE OR INJURY TO
* PROPERTY AND LOST PROFITS, REGARDLESS OF WHETHER CALTECH, JPL, OR NASA BE
* ADVISED, HAVE REASON TO KNOW, OR, IN FACT, SHALL KNOW OF THE POSSIBILITY.
*
* RECIPIENT BEARS ALL RISK RELATING TO QUALITY AND PERFORMANCE OF THE SOFTWARE
* AND ANY RELATED MATERIALS, AND AGREES TO INDEMNIFY CALTECH AND NASA FOR
* ALL THIRD-PARTY CLAIMS RESULTING FROM THE ACTIONS OF RECIPIENT IN THE USE
* OF THE SOFTWARE.
*/
