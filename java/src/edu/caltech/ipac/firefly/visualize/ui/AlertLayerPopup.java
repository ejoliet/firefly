package edu.caltech.ipac.firefly.visualize.ui;
/**
 * User: roby
 * Date: 9/26/12
 * Time: 4:15 PM
 */


import edu.caltech.ipac.firefly.commands.LayerCmd;
import edu.caltech.ipac.firefly.visualize.AllPlots;

/**
 * @author Trey Roby
 */
@Deprecated
public class AlertLayerPopup {

    public static final int MAX_ALERT_CNT=2;
    public static int _turnOnCount = 0;
    public static int _attentionChanges= 0;
    public static boolean _alertOn;
    public static boolean _dialogVisible= false;

    public static void setAlert(boolean alert) {
        if (!_dialogVisible) {
            if (alert) _turnOnCount++;
            else if (_turnOnCount >0)      _turnOnCount--;
            boolean turnAlertOn= _turnOnCount >0;
            if (!_alertOn && turnAlertOn) {
                _attentionChanges++;
            }
            getLayerCmd().setAttention(_attentionChanges<=MAX_ALERT_CNT && turnAlertOn);
            _alertOn= turnAlertOn;
        }
    }

    public static void setLayerDialogVisibleStatus(boolean v) {
        _dialogVisible= v;
        AlertLayerPopup.killAlert();
    }

    private static void killAlert() {
        _turnOnCount = 0;
        _alertOn= false;
        getLayerCmd().setAttention(false);
    }

    private static LayerCmd getLayerCmd() {
        return (LayerCmd) AllPlots.getInstance().getCommand(LayerCmd.CommandName);
    }


}

/*
 * THIS SOFTWARE AND ANY RELATED MATERIALS WERE CREATED BY THE CALIFORNIA 
 * INSTITUTE OF TECHNOLOGY (CALTECH) UNDER A U.S. GOVERNMENT CONTRACT WITH 
 * THE NATIONAL AERONAUTICS AND SPACE ADMINISTRATION (NASA). THE SOFTWARE 
 * IS TECHNOLOGY AND SOFTWARE PUBLICLY AVAILABLE UNDER U.S. EXPORT LAWS 
 * AND IS PROVIDED AS-IS TO THE RECIPIENT WITHOUT WARRANTY OF ANY KIND, 
 * INCLUDING ANY WARRANTIES OF PERFORMANCE OR MERCHANTABILITY OR FITNESS FOR 
 * A PARTICULAR USE OR PURPOSE (AS SET FORTH IN UNITED STATES UCC 2312- 2313) 
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
