package gfx;

import javax.microedition.lcdui.*;
import javax.microedition.midlet.*;

public class DrawSubstringTest extends MIDlet {
    private Display display;

    class TestCanvas extends Canvas {
        protected void paint(Graphics g) {
            g.setColor(0x00FFFFFF);
            g.fillRect(0, 0, getWidth(), getHeight());
            g.setColor(0);
            g.setStrokeStyle(Graphics.SOLID);
            g.drawSubstring("Faber est suae quisque fortunae", 23, 7, 0, 0, Graphics.TOP | Graphics.LEFT);
            System.out.println("PAINTED");
        }
    }

    public DrawSubstringTest() {
        display = Display.getDisplay(this);
    }

    public void startApp() {
        TestCanvas test = new TestCanvas();
        test.setFullScreenMode(true);
        display.setCurrent(test);
    }

    public void pauseApp() {
    }

    public void destroyApp(boolean unconditional) {
    }
}

